import { DataSource } from 'typeorm';
import { Follow } from '../../src/modules/profiles/entities/follow.entity.js';
import { User } from '../../src/modules/users/entities/user.entity.js';

export async function createFakeFollow(
  dataSource: DataSource,
  follower: User,
  following: User,
): Promise<Follow> {
  const followRepository = dataSource.getRepository(Follow);

  const follow = followRepository.create({
    followerId: follower.id,
    followingId: following.id,
  });

  return followRepository.save(follow);
}
