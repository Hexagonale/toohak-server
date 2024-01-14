import 'module-alias/register';

import { ConfigProvider, EventsManager, GamesManager, Logger, RankingService, RoundManager } from '@shared';
import cors from 'cors';
import dotenv from 'dotenv';
import express, { Express } from 'express';
import admin from 'firebase-admin';
import fs from 'fs';
import https from 'https';

import serviceAccount from './firebase.creds.json';
import { connect, createGame, finishGame, finishRound, joinGame, sendAnswer, sendQuestion } from './functions';
import { AuthenticationConfigFactory } from './providers';

dotenv.config({
    path: './authentication.env',
});

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    databaseURL: 'https://toohak-58bc4-default-rtdb.europe-west1.firebasedatabase.app',
});

const logger = new Logger('Authentication');
logger.setLogFilePath('./server.log');

const main = async () => {
    const app: Express = express();
    app.use(express.json());
    app.use(cors({ credentials: true, origin: true }));
    app.use(express.static('public'));

    const configProvider = new ConfigProvider(new AuthenticationConfigFactory());
    const config = await configProvider.init();
    if (!config) {
        logger.fatal('Failed to load config!');

        process.exit(1);
    }

    const certificate = fs.readFileSync(config.fullchainPath);
    const privateKey = fs.readFileSync(config.privkeyPath);

    const gamesManager = new GamesManager(admin.firestore());
    const roundManager = new RoundManager(admin.database());
    const eventsManager = EventsManager.instance;

    const rankingService = new RankingService(roundManager);

    app.post('/create_game', createGame({ gamesManager }));
    app.post('/finish_round', finishRound({ gamesManager, roundManager, rankingService, eventsManager }));
    app.post('/finish_game', finishGame({ gamesManager, roundManager, rankingService, eventsManager }));
    app.post('/join_game', joinGame({ gamesManager, eventsManager }));
    app.post('/send_answer', sendAnswer({ gamesManager, roundManager }));
    app.post('/send_question', sendQuestion({ gamesManager, eventsManager, roundManager }));

    logger.info('Starting server...');

    const serverSettings = {
        key: privateKey,
        cert: certificate,
    };

    const server = https.createServer(serverSettings, app).listen(config.port, '146.59.77.211', () => {
        logger.info(`Server listening on port ${config.port}`);
    });

    server.on(
        'upgrade',
        connect({
            gamesManager,
            eventsManager,
        })
    );
};

main();
