import { Answer, Game, Logger, Round, RoundManager } from '@shared';

export interface PlayerEndGameRanking {
    userToken: string;
    didPlayerLost: boolean;
    totalPoints: number;
    finalPosition: number;
    questionsAnswered: number;
    questionsAnsweredCorrectly: number;
    averageAnswerTime: number;
}

export interface PlayerEndRoundRanking {
    userToken: string;
    wasAnswerCorrect: boolean | null;
    pointsForThisRound: number;
    totalPoints: number;
    currentPosition: number;
    answeredNth: number | null;
}

export interface Ranking {
    endGame: PlayerEndGameRanking[];
    endRound: PlayerEndRoundRanking[];
}

export class RankingService {
    constructor(private readonly roundManager: RoundManager) {}

    private readonly logger = new Logger('RankingService');

    async calculateRanking({
        game,
        round,
        correctAnswerIndex,
        maxPoints,
        currentPoints,
    }: {
        game: Game;
        round: Round;
        correctAnswerIndex: number;
        maxPoints: number;
        currentPoints: { [key: string]: number };
    }): Promise<Ranking> {
        const answers = (await this.roundManager.getRoundAnswers(game.id, round.round_index)) ?? [];

        const roundPoints: { playerToken: string; points: number }[] = [];
        const answerTimes: { playerToken: string; answeredAfterMs: number }[] = [];
        const ranking: Ranking = {
            endGame: [],
            endRound: [],
        };

        for (const answer of answers) {
            if (answer.answer_index !== correctAnswerIndex) {
                if (!round.is_hardcore) {
                    this.logger.info('calculateRanking, player answered incorrectly, but game is not hardcore.', {
                        answer,
                    });

                    continue;
                }

                const endGameRanking = await this.calculateEndGameRanking({
                    userToken: answer.player_token,
                    gameId: game.id,
                    didPlayerLost: true,
                    finalPosition: 0,
                    totalPoints: currentPoints[answer.player_token] ?? 0,
                });
                ranking.endGame.push(endGameRanking);

                this.logger.info('calculateRanking, player answered incorrectly, game is hardcore.', {
                    answer,
                    endGameRanking,
                });
            }

            const points = this.calculatePointsForRound({
                round,
                answer,
                correctAnswerIndex,
                maxPoints,
            });

            this.logger.info('calculateRanking, calculated points for player.', {
                answer,
                points,
            });

            roundPoints.push({ playerToken: answer.player_token, points: points.roundPoints });
            answerTimes.push({ playerToken: answer.player_token, answeredAfterMs: points.answeredAfterMs });
        }

        roundPoints.sort((a, b) => b.points - a.points);
        answerTimes.sort((a, b) => a.answeredAfterMs - b.answeredAfterMs);

        for (const player of game.players ?? []) {
            const hasPlayerLost = ranking.endGame.find((endGameRanking) => endGameRanking.userToken === player.token);
            if (hasPlayerLost) {
                continue;
            }

            const currentPlayerPoints = currentPoints[player.token] ?? 0;
            const pointsForThisRound = roundPoints.find((points) => points.playerToken === player.token)?.points;
            const finalPoints = currentPlayerPoints + (pointsForThisRound ?? 0);
            const currentPosition = roundPoints.findIndex((points) => points.playerToken === player.token) + 1;
            const answeredNth = answerTimes.findIndex((answerTime) => answerTime.playerToken === player.token);

            ranking.endRound.push({
                userToken: player.token,
                wasAnswerCorrect: pointsForThisRound !== undefined ? true : null,
                pointsForThisRound: pointsForThisRound ?? 0,
                totalPoints: finalPoints,
                currentPosition,
                answeredNth: answeredNth === -1 ? null : answeredNth + 1,
            });
        }

        ranking.endRound.sort((a, b) => b.totalPoints - a.totalPoints);

        this.logger.info('calculateRanking, ranking calculated.', ranking);

        return ranking;
    }

    async calculateEndGameRanking({
        userToken,
        gameId,
        didPlayerLost,
        totalPoints,
        finalPosition,
    }: {
        userToken: string;
        gameId: string;
        didPlayerLost: boolean;
        totalPoints: number;
        finalPosition: number;
    }): Promise<PlayerEndGameRanking> {
        const playerAnswers = await this.roundManager.getAnswersForPlayer(gameId, userToken);
        const rounds = await this.roundManager.getRoundsForGame(gameId);

        let answeredCorrectly = 0;
        let totalAnswerTime = 0;
        for (const answer of playerAnswers) {
            const round = rounds.find((round) => round.round_index === answer.for_round_index);
            if (!round) {
                continue;
            }

            if (round.correct_answer_index === answer.answer_index) {
                answeredCorrectly += 1;
            }

            const answeredAfterMs = answer.answer_time.getTime() - round.started_at.getTime();
            totalAnswerTime += answeredAfterMs;
        }

        return {
            userToken,
            didPlayerLost,
            totalPoints,
            finalPosition,
            questionsAnswered: playerAnswers.length,
            questionsAnsweredCorrectly: answeredCorrectly,
            averageAnswerTime: playerAnswers.length === 0 ? 0 : Math.round(totalAnswerTime / playerAnswers.length),
        };
    }

    private calculatePointsForRound({
        round,
        answer,
        correctAnswerIndex,
        maxPoints,
    }: {
        round: Round;
        answer: Answer;
        correctAnswerIndex: number;
        maxPoints: number;
    }) {
        const answeredAfterMs = answer.answer_time.getTime() - round.started_at.getTime();
        if (answer.answer_index !== correctAnswerIndex) {
            this.logger.info('calculateRanking, player answered incorrectly, returning 0 points.');

            return {
                roundPoints: 0,
                answeredAfterMs,
            };
        }

        const answeredAfterPercent = answeredAfterMs / (round.time_in_seconds * 1000);

        // You will get from 100% to 50% of the points, depending on how fast you answered.
        const pointsPercent = 1 - answeredAfterPercent * 0.5;
        const points = Math.round(maxPoints * pointsPercent);

        // If you used a hint, you will get half of the points.
        const finalPoints = answer.was_hint_used ? Math.round(points / 2) : points;

        return {
            roundPoints: finalPoints,
            answeredAfterMs,
        };
    }
}
