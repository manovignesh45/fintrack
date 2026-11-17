import { useRef } from 'react';
import { ScrollView } from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import { useRouter } from 'expo-router';
import { commitmentsApi } from '@/src/api/client';
import { FormScreen } from '@/src/components/ui/FormScreen';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import CommitmentForm from '@/src/components/CommitmentForm';
import { useToast } from '@/src/context/ToastContext';
import { notifyCommitmentsChanged } from '@/src/hooks/useHasCommitments';
import type { CommitmentInput } from '@fintrack/shared';

export default function NewCommitmentScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const scrollRef = useRef<ScrollViewInstance>(null);

  const handleSubmit = async (data: CommitmentInput) => {
    await commitmentsApi.create(data);
    notifyCommitmentsChanged();
    showToast('Commitment created');
    router.back();
  };

  return (
    <FormScreen ref={scrollRef} header={<ScreenHeader title="New Commitment" />}>
      <CommitmentForm onSubmit={handleSubmit} submitLabel="Save Commitment" />
    </FormScreen>
  );
}
