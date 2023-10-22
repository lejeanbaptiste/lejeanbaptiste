import axios from 'axios';
import { logHttpError } from './utilities';

interface ServiceError {
  msg: string;
  type: string;
  loc: [string, number];
}

const BASE_URL = 'https://leaf-turning.leaf-vre.org/v1';

export const listTransformations = async ({ from, to }: { from?: string; to?: string }) => {
  if (from && to) {
    throw new Error(`Must provide just one property: 'from' | 'to'`);
  }

  const { data } = await axios.get<Record<string, string[]>>(`${BASE_URL}/list-transformations`);
  if (from) {
    const possibleType = data[from] ?? [];
    return possibleType;
  }

  if (to) {
    const possibleType = new Set<string>();
    Object.entries(data).forEach(([fromType, toType]) => {
      if (toType.includes(to)) possibleType.add(fromType);
    });
    return [...possibleType];
  }

  throw new Error(`Must provide a property: 'from' | 'to'`);
};

interface ConversionRequest {
  content: string;
  fromType: string;
  toType: string;
}

interface ConversionResponse {
  transformed_string: string;
  details?: ServiceError;
}

export const convertDocument = async ({ content, fromType, toType }: ConversionRequest) => {
  try {
    const { data } = await axios.post<ConversionResponse>(`${BASE_URL}/transform-string`, {
      input_string: content,
      from_type: fromType,
      to_type: toType,
    });
    return data.transformed_string;
  } catch (error) {
    logHttpError(error);

    if (axios.isAxiosError(error) && error.response?.data) {
      const data = error.response.data as ConversionResponse;

      if (data.details) {
        const { status } = error.response;
        const { details } = data;
        if (status === 422) {
          return new Error(`${details.type}: ${details.msg}. Location: ${details.loc.join(',')}`);
        }
        if (status >= 400) return new Error(details.msg);
      }
      return new Error(error.message);
    }
    return new Error('error');
  }
};
