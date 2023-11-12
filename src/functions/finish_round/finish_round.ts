// import admin from 'firebase-admin';
// import { z } from 'zod';
// import {
//     EventsManager,
//     GamesManager,
//     RoundManager,
//     functionErrorHandler,
//     RankingService,
//     zodBodyValidator,
//     Logger,
//     rankingPlayer,
//     RankingPlayer,
// } from '../shared';
// import { CallableRequest, HttpsError, onCall } from 'firebase-functions/v2/https';

// const schema = z.object({
//     game_id: z.string().min(1),
//     correct_answer_index: z.number().int().min(0),
//     max_points: z.number().int().positive(),
//     current_ranking: z.array(rankingPlayer),
// });

// const logger = new Logger('FinishRound');

// const gamesManager = new GamesManager(admin.firestore());
// const roundManager = new RoundManager(admin.database());
// const eventsManager = new EventsManager(admin.messaging());
// const rankingService = new RankingService(roundManager);

// const handler = async (
//     body: z.infer<typeof schema>,
//     request: CallableRequest
// ): Promise<{ ranking: RankingPlayer[] }> => {
//     const authData = request.auth;
//     if (!authData) {
//         throw new HttpsError('unauthenticated', 'Unauthenticated');
//     }

//     const game = await gamesManager.getGameById(body.game_id);
//     if (!game) {
//         throw new HttpsError('not-found', 'Game not found');
//     }

//     if (game.created_by !== authData.uid) {
//         throw new HttpsError('permission-denied', 'You are not the owner of this game');
//     }

//     const round = await roundManager.getLastRoundForGame(game.id);
//     if (!round) {
//         throw new HttpsError('not-found', 'Round not found');
//     }

//     if (round.is_finished) {
//         throw new HttpsError('permission-denied', 'Round already finished');
//     }

//     await roundManager.finishRound(round, body.correct_answer_index);

//     const ranking = await rankingService.calculateRanking({
//         game,
//         round,
//         correctAnswerIndex: body.correct_answer_index,
//         maxPoints: body.max_points,
//         currentPoints: Object.fromEntries(
//             body.current_ranking.map((rankingPlayer) => [rankingPlayer.token, rankingPlayer.points])
//         ),
//     });

//     const finalRanking: RankingPlayer[] = [];

//     const notificationPromises: Promise<void>[] = [];
//     for (const endGameRanking of ranking.endGame) {
//         console.log('Notifying end game', endGameRanking);

//         notificationPromises.push(eventsManager.notifyGameOver(endGameRanking));

//         const player = game.players?.find((player) => player.token === endGameRanking.userToken);
//         if (!player) {
//             logger.error('Player not found in the game', { endGameRanking });

//             continue;
//         }

//         await gamesManager.removePlayerFromGame(game.id, player);

//         finalRanking.push({
//             token: endGameRanking.userToken,
//             username: player.username,
//             points: endGameRanking.totalPoints,
//             round_lost: round.round_index,
//         });
//     }

//     for (const endRoundRanking of ranking.endRound) {
//         notificationPromises.push(eventsManager.notifyRoundFinished(endRoundRanking));

//         const player = game.players?.find((player) => player.token === endRoundRanking.userToken);
//         if (!player) {
//             logger.error('Player not found in the game', { endRoundRanking });

//             continue;
//         }

//         finalRanking.push({
//             token: endRoundRanking.userToken,
//             username: player.username,
//             points: endRoundRanking.totalPoints,
//             round_lost: null,
//         });
//     }

//     await Promise.all(notificationPromises);

//     return {
//         ranking: finalRanking,
//     };
// };

// // eslint-disable-next-line camelcase
// export const finish_round = onCall(functionErrorHandler(zodBodyValidator(schema, handler)));
