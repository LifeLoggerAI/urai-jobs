
import { echo } from './echo';
import { wait } from './wait';

export const handlers: { [key: string]: (payload: any) => Promise<void> } = {
    echo,
    wait,
};
