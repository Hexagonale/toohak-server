import { firestore } from 'firebase-admin';

import { Game, Player } from '.';

export class GamesManager {
    constructor(private readonly firestore: firestore.Firestore) {}

    async createGame(game: Game): Promise<Game> {
        const collection = this.firestore.collection('games');
        const partial: Partial<Game> = { ...game };
        delete partial.id;

        const docRef = await collection.add(partial);
        const doc = await docRef.get();

        return { ...doc.data(), id: doc.id } as Game;
    }

    async getGameById(gameId: string): Promise<Game | null> {
        const gameDoc = await this.firestore.collection('games').doc(gameId).get();
        if (!gameDoc.exists) {
            return null;
        }

        return { ...gameDoc.data(), id: gameDoc.id } as Game;
    }

    async getGameByCode(code: string): Promise<Game | null> {
        const gameRef = this.firestore.collection('games').where('code', '==', code).limit(1);
        const gameSnapshot = await gameRef.get();
        if (gameSnapshot.empty) {
            return null;
        }

        const gameDoc = gameSnapshot.docs[0];

        return { ...gameDoc.data(), id: gameDoc.id } as Game;
    }

    async addPlayerToGame(gameId: string, player: Player): Promise<void> {
        const gameRef = this.firestore.collection('games').doc(gameId);
        await gameRef.update({
            players: firestore.FieldValue.arrayUnion(player),
        });
    }

    async removePlayerFromGame(gameId: string, player: Player): Promise<void> {
        const gameRef = this.firestore.collection('games').doc(gameId);
        await gameRef.update({
            players: firestore.FieldValue.arrayRemove(player),
        });
    }

    async blockSignUp(gameId: string): Promise<void> {
        const gameRef = this.firestore.collection('games').doc(gameId);
        await gameRef.update({
            sign_up_blocked: true,
        });
    }
}
