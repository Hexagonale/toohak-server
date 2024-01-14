import { Player } from '.';

export interface Game {
    id: string;
    game_template_id: string;
    code: string;
    sign_up_blocked: boolean;
    admin_token: string;
    players: Player[] | null;
    created_by: string;
}
