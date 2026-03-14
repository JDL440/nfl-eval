import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { v4 as uuid } from 'uuid';

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
};

// Create Redis connection
export const redis = new Redis(redisConfig);

// Initialize queues
export const articleDraftQueue = new Queue('article-draft', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: false,
    removeOnFail: false,
  },
});

export const articleReviewQueue = new Queue('article-review', {
  connection: redis,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: false,
    removeOnFail: false,
  },
});

export const articlePublishQueue = new Queue('article-publish', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: false,
    removeOnFail: false,
  },
});

// Initialize queue event listeners
export function initializeQueueListeners() {
  [articleDraftQueue, articleReviewQueue, articlePublishQueue].forEach((queue) => {
    queue.on('error', (err) => {
      console.error(`Queue ${queue.name} error:`, err);
    });

    queue.on('waiting', (job) => {
      console.log(`[${queue.name}] Job ${job.id} waiting`);
    });

    queue.on('active', (job) => {
      console.log(`[${queue.name}] Job ${job.id} active`);
    });

    queue.on('completed', (job) => {
      console.log(`[${queue.name}] Job ${job.id} completed`);
    });

    queue.on('failed', (job, err) => {
      console.error(`[${queue.name}] Job ${job.id} failed:`, err.message);
    });
  });
}

// Health check
export async function checkRedisConnection() {
  try {
    await redis.ping();
    console.log('✅ Redis connection established');
    return true;
  } catch (err) {
    console.error('❌ Redis connection failed:', err.message);
    return false;
  }
}

export default {
  redis,
  articleDraftQueue,
  articleReviewQueue,
  articlePublishQueue,
  initializeQueueListeners,
  checkRedisConnection,
};
