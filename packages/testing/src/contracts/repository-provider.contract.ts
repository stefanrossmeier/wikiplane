import type { RepositoryProvider, RepositoryTarget } from '@wikiplane/application';

export async function exerciseRepositoryProviderContract(
  provider: RepositoryProvider,
  target: RepositoryTarget,
): Promise<void> {
  const session = await provider.open(target);
  const operation = await session.begin('contract');
  if (!operation.root) throw new Error('Repository operation must expose a root');
  await operation.close();
  await session.close();
}
