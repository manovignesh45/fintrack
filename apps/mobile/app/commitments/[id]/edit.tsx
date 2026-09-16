import { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { commitmentsApi } from '@/src/api/client';
import { FormScreen } from '@/src/components/ui/FormScreen';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import CommitmentForm from '@/src/components/CommitmentForm';
import { useToast } from '@/src/context/ToastContext';
import { notifyCommitmentsChanged } from '@/src/hooks/useHasCommitments';
import type { Commitment, CommitmentInput } from '@fintrack/shared';

export default function EditCommitmentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const scrollRef = useRef<ScrollView>(null);
  const [initial, setInitial] = useState<Commitment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    commitmentsApi
      .get(parseInt(id, 10))
      .then((c) => setInitial(c))
      .catch(() => router.back())
      .finally(() => setLoading(false));
  }, [id, router]);

  const handleSubmit = async (data: CommitmentInput) => {
    if (!id) return;
    await commitmentsApi.update(parseInt(id, 10), data);
    notifyCommitmentsChanged();
    showToast('Commitment updated');
    router.back();
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-gray-900">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!initial) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Text className="text-red-500">Commitment not found</Text>
      </View>
    );
  }

  return (
    <FormScreen ref={scrollRef} header={<ScreenHeader title="Edit Commitment" />}>
      <CommitmentForm initial={initial} onSubmit={handleSubmit} submitLabel="Update Commitment" />
    </FormScreen>
  );
}
