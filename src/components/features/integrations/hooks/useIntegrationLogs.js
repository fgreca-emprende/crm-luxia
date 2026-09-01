import { useState, useCallback } from 'react';
import { getConfigGeneral, setConfigGeneral } from '../../../../lib/configGeneral';
import { useToast } from '../../../ui/ToastProvider';

export function useIntegrationLogs() {
  const { showAlert } = useToast();
  
  // Webhook Logs
  const [webhookLogs, setWebhookLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Inbound API Logs
  const [apiLogs, setApiLogs] = useState([]);
  const [loadingApiLogs, setLoadingApiLogs] = useState(false);

  const fetchWebhookLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const logs = await getConfigGeneral('incoming_webhook_logs');
      const list = Array.isArray(logs) ? logs.map(d => ({
        ...d,
        formattedDate: d.timestamp ? new Date(d.timestamp).toLocaleString() : 'Pendiente'
      })) : [];
      setWebhookLogs(list);
    } catch (error) {
      console.warn('Error fetching webhook logs:', error);
      showAlert('Error al cargar historial de webhooks.', 'danger');
    } finally {
      setLoadingLogs(false);
    }
  }, [showAlert]);

  const clearWebhookLogs = async () => {
    try {
      await setConfigGeneral('incoming_webhook_logs', []);
      setWebhookLogs([]);
      showAlert('Logs de webhook vaciados correctamente.', 'success');
    } catch (err) {
      console.warn('Error vaciando logs de webhook:', err);
      showAlert('Error al vaciar los logs de webhook.', 'danger');
    }
  };

  const fetchApiLogs = useCallback(async () => {
    setLoadingApiLogs(true);
    try {
      const logs = await getConfigGeneral('incoming_api_logs');
      const list = Array.isArray(logs) ? logs.map(d => ({
        ...d,
        formattedDate: d.timestamp ? new Date(d.timestamp).toLocaleString() : 'Pendiente'
      })) : [];
      setApiLogs(list);
    } catch (error) {
      console.warn('Error fetching API logs:', error);
      showAlert('Error al cargar historial de logs de API.', 'danger');
    } finally {
      setLoadingApiLogs(false);
    }
  }, [showAlert]);

  const clearApiLogs = async () => {
    try {
      await setConfigGeneral('incoming_api_logs', []);
      setApiLogs([]);
      showAlert('Logs de API vaciados correctamente.', 'success');
    } catch (err) {
      console.warn('Error vaciando logs de API:', err);
      showAlert('Error al vaciar los logs de API.', 'danger');
    }
  };

  return {
    webhookLogs,
    loadingLogs,
    fetchWebhookLogs,
    clearWebhookLogs,
    apiLogs,
    loadingApiLogs,
    fetchApiLogs,
    clearApiLogs
  };
}
