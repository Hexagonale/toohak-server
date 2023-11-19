import { Logger } from '@shared';
import { Request, Response } from 'express';
import admin from 'firebase-admin';

type Handler = (request: Request, response: Response) => Promise<unknown>;

export enum AuthLevel {
    None,
    Admin,
}

const logger = new Logger('auth');

export const auth = (authLevel: AuthLevel, handler: Handler) => {
    return async (req: Request, res: Response): Promise<void> => {
        logger.info('Authenticating request', { authLevel, headers: req.headers });

        if (authLevel === AuthLevel.None) {
            await handler(req, res);

            return;
        }

        const authHeader = req.headers.authorization;
        if (!authHeader) {
            res.status(401).send({ error: 'No authorization header' });

            return;
        }

        const [authType, authValue] = authHeader.split(' ');
        if (authType !== 'Bearer') {
            res.status(401).send({ error: 'Invalid authorization type' });

            return;
        }

        if (!authValue) {
            res.status(401).send({ error: 'No authorization value' });

            return;
        }

        try {
            logger.info('Verifying token', { authValue });

            const decodedToken = await admin.auth().verifyIdToken(authValue);

            req.authToken = decodedToken;

            handler(req, res);
        } catch (error) {
            logger.info('Error verifying token', error);

            res.status(401).send({ error: 'Invalid authorization token' });
        }
    };
};
