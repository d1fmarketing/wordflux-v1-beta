import dynamic from 'next/dynamic';

const SafeWorkspace = dynamic(() => import('../components/SafeWorkspace'), {
  ssr: false,
  loading: () => <div style={{ padding: 16, textAlign: 'center' }}>Loading workspace...</div>,
});

export default function WorkspacePage() {
  return <SafeWorkspace />;
}
