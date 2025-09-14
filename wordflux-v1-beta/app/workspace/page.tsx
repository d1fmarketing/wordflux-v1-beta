import dynamicImport from 'next/dynamic';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SafeWorkspace = dynamicImport(() => import('../components/SafeWorkspace'), {
  ssr: false,
  loading: () => <div style={{ padding: 16, textAlign: 'center' }}>Loading workspace...</div>,
});

export default function WorkspacePage() {
  return <SafeWorkspace />;
}
