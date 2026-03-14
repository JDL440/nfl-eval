import { useState } from 'react';
import { publishArticle } from '../api/queueClient';

export default function usePublishArticle() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [substackUrl, setSubstackUrl] = useState(null);

  const publish = async (id) => {
    setLoading(true);
    setError(null);
    setSubstackUrl(null);
    try {
      const result = await publishArticle(id);
      setSubstackUrl(result.substackUrl);
      setLoading(false);
      return result;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      return null;
    }
  };

  const reset = () => {
    setLoading(false);
    setError(null);
    setSubstackUrl(null);
  };

  return { publish, loading, error, substackUrl, reset };
}
