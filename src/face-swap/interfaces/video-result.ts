export interface IVideoResult {
  success: boolean;
  isLoading: boolean;
  message: string;
  vidUrl: string | null;
  error?: INovitaError;
}

interface INovitaError {
  code: number;
  reason: string;
  message: string;
  metadata: object;
}
