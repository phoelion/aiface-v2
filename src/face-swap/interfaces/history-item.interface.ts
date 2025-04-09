import { SwapTypesEnum } from 'src/users/enums/swap-types.enum';

export interface IHistoryItem {
  id: string;
  success: boolean;
  isLoading: boolean;
  message: string;
  resultUrl: string | null;
  type: SwapTypesEnum;
}
