import { createLazyFileRoute } from '@tanstack/react-router';
import { PipelineScreen } from '../features/pipeline/pipeline-screen';

export const Route = createLazyFileRoute('/pipeline')({ component: PipelineScreen });
