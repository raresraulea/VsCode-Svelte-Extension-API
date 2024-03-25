import "reflect-metadata";
require('dotenv').config();
import express from 'express';
import { createConnection } from 'typeorm';
import { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, JWT_SECRET, __prod__ } from "./constants";
import { join } from "path";
import jsonwebtoken from 'jsonwebtoken';
import cors from 'cors';

import {Strategy as GitHubStrategy} from 'passport-github';
import passport from "passport";
import { User } from "./entities/User";

const main = async () => {
    
    await createConnection({
        type: 'postgres',
        database: 'vstodo',
        // dropSchema: true,
        synchronize: !__prod__,
        logging: !__prod__,
        entities: [join(__dirname, './entities/*.*')]
    });
    const app = express();

    app.use(cors({ origin: '*' }));

    // const user = User.create({ username: 'bob' }).save();
    // console.log('user:', user);

    passport.serializeUser(function (user: any, done) {
        done(null, user.accessToken);
    });

    app.use(passport.initialize());
    // app.use(cors())

    passport.use(
        new GitHubStrategy(
            {
                clientID: GITHUB_CLIENT_ID,
                clientSecret: GITHUB_CLIENT_SECRET,
                callbackURL: "http://localhost:3002/auth/github/callback"
            },
            async (_, __, profile, cb) => {
                let user = await User.findOne({ where: { githubId: profile.id } });

                if (!user) {
                    user = await User.create({ githubId: profile.id, name: profile.displayName }).save();
                }
                else {
                    user.name = profile.displayName;
                    await user.save();
                }
                cb(null, {accessToken: jsonwebtoken.sign({ userId: user.id }, JWT_SECRET!, { expiresIn: '1y' })});
            }
        )
    );
    
    app.get('/', (_req, res) => {
        res.send('Hello World');
    });

    // Going here will initiate the Github authentication process
    app.get(
        '/auth/github',
        passport.authenticate('github', {session: false})
    );
    
    // This is the redirect URL that the OAuth provider will redirect the user to after they have authenticated
    app.get('/auth/github/callback', 
        passport.authenticate(
            'github',
            { failureRedirect: '/login', session: false }
        ),
        (req, res) => {
            // Successful authentication, redirect home.
            res.redirect('http://localhost:54321/auth/' + (req.user as any)?.accessToken);
        });
    
    app.get("/me", async (req, res) => {
        // Bearer 120jdklowqjed021901
        const authHeader = req?.headers?.authorization;
        console.log('authHeader CS:', req?.headers);
        if (!authHeader) {
            res.send({ user: null });
            return;
        }

        const token = authHeader.split(" ")[1];
        if (!token) {
            res.send({ user: null });
            return;
        }

        let userId = "";

        try {
            const payload: any = jsonwebtoken.verify(token, JWT_SECRET!);
            userId = payload.userId;
            console.log('payload:', payload);
        } catch (err) {
            res.send({ user: null });
            return;
        }

        if (!userId) {
            res.send({ user: null });
            return;
        }

        const user = await User.findOne({
            where: {
                id: userId as any,
            
            }
        });
        
        console.log('user:', user);

        res.send({ user });
    });
    
    app.listen(3002, () => {
        console.log('Server is running on http://localhost:3002');
    });
}

main();