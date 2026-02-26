import { createLazyFileRoute } from '@tanstack/react-router';
import { FeedScreen } from '../features/feed/feed-screen';

export const Route = createLazyFileRoute('/feed')({ component: FeedScreen });
