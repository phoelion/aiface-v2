import { SwapTypesEnum } from 'src/users/enums/swap-types.enum';

export interface IHistoryItem {
  success: boolean;
  jobId: string | null;
  isLoading: boolean;
  message: string;
  resultUrl: string | null;
  type: SwapTypesEnum;
}
