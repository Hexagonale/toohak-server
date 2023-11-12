import { EventsManager, GamesManager, Logger } from '@shared';
import { Request } from 'express';
import { Duplex } from 'stream';

interface Dependencies {
    gamesManager: GamesManager;
    eventsManager: EventsManager;
}

const logger = new Logger('connect');

export const connect = (dependencies: Dependencies) => {
    const { gamesManager, eventsManager } = dependencies;

    return async (request: Request, socket: Duplex, head: Buffer) => {
        logger.info('connect, handling upgrade...');

        eventsManager.registerUser(
            async (handshake: string) => {
                logger.info('connect, received handshake', { handshake });

                const [token, gameId] = handshake.split('\n');
                if (!gameId || !token || typeof gameId !== 'string' || typeof token !== 'string') {
                    logger.warning('connect, missing game_id or token', { gameId, token });

                    return null;
                }

                const game = await gamesManager.getGameById(gameId);
                if (!game) {
                    logger.warning('connect, game not found', { gameId });

                    return null;
                }

                if (game.admin_token === token) {
                    logger.info('Registering admin', { gameId, token });

                    return token;
                }

                const player = game.players?.find((player) => player.token === token);
                if (player) {
                    logger.info('Registering player', { gameId, token });

                    return token;
                }

                return null;
            },
            request,
            socket,
            head
        );
    };
};
