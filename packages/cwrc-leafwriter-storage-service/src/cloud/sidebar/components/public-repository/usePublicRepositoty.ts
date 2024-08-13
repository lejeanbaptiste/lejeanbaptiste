import { db } from '../../../../db';
import { PublicRepository } from '../../../../types';
import { log } from '../../../../utilities';

export const usePublicRepository = () => {
  const addPublicRepository = async (publicRepository: PublicRepository) => {
    await db.publicRepositories.add(publicRepository).catch(() => {
      log.debug('Public Repository already added.', publicRepository);
    });
  };

  const getPublicRepository = async (uuid: string) => {
    return await db.publicRepositories.get(uuid);
  };

  const getPublicRepositoryByUsername = async (username: string) => {
    return await db.publicRepositories.get({ username });
  };

  const removePublicRepository = async (uuid: string) => {
    await db.publicRepositories.delete(uuid);
  };

  return {
    addPublicRepository,
    getPublicRepository,
    getPublicRepositoryByUsername,
    removePublicRepository,
  };
};
