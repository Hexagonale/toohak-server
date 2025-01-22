import 'module-alias/register';

import { EventsManager, GamesManager, Logger, RankingService, RoundManager } from '@shared';
import cors from 'cors';
import express, { Express } from 'express';
import admin from 'firebase-admin';
import http from 'http';

import serviceAccount from './firebase.creds.json';
import { connect, createGame, finishGame, finishRound, joinGame, sendAnswer, sendQuestion } from './functions';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    databaseURL: 'https://toohak-58bc4-default-rtdb.europe-west1.firebasedatabase.app',
});

const logger = new Logger('Toohak');
logger.setLogFilePath('./server.log');

const main = async () => {
    const app: Express = express();
    app.use(express.json());
    app.use(cors({ credentials: true, origin: true }));
    app.use(express.static('public'));

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

    const server = http.createServer(app).listen(80, () => {
        logger.info('Server listening on port 80');
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
