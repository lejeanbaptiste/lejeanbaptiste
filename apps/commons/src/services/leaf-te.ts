import { log } from '@src/utilities';

const BASE_URL = 'https://leaf-turning.leaf-vre.org/v1';

const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw { response: { data: errorData, status: response.status } };
  }
  return response.json();
};

export const listTransformations = async ({ from, to }: { from?: string; to?: string }) => {
  if (from && to) {
    throw new Error(`Must provide just one property: 'from' | 'to'`);
  }

  const data = await fetch(`${BASE_URL}/list-transformations`)
    .then((response) => handleResponse<Record<string, string[]>>(response))
    .catch((error) => {
      log.error('Error', error.message);
      throw error;
    });

  if (from) {
    return data[from] ?? [];
  }

  if (to) {
    const possibleType = new Set<string>();
    Object.entries(data).forEach(([fromType, toType]) => {
      if (toType.includes(to)) possibleType.add(fromType);
    });
    return [...possibleType].sort();
  }

  throw new Error(`Must provide a property: 'from' | 'to'`);
};

interface ConversionRequest {
  content: string;
  fromType: string;
  toType: string;
}

interface ServiceError {
  msg: string;
  type: string;
  loc: [string, number];
}

interface ConversionResponse {
  transformed_string: string;
  details?: ServiceError;
}

export const convertDocument = async ({ content, fromType, toType }: ConversionRequest) => {
  const response = await fetch(`${BASE_URL}/transform-string`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input_string: content,
      from_type: fromType,
      to_type: toType,
    }),
  });

  const data = await handleResponse<ConversionResponse>(response).catch((error) => {
    log.error('Error', error.message);

    if (error.response?.data) {
      const data = error.response.data as ConversionResponse;

      if (data.details) {
        const status = error.response.status;
        const { details } = data;
        if (status === 422) {
          throw new Error(`${details.type}: ${details.msg}. Location: ${details.loc.join(',')}`);
        }
        if (status >= 400) throw new Error(details.msg);
      }
      throw new Error(error.message || 'An error occurred');
    }
    throw new Error('An unexpected error occurred');
  });

  return data.transformed_string;
};
