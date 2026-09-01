import { useState, useCallback } from 'react';
import { getConfigGeneral, setConfigGeneral } from '../../../../lib/configGeneral';
import { useToast } from '../../../ui/ToastProvider';

export function useApiKeys() {
  const { showAlert } = useToast();
  const [apiKeys, setApiKeys] = useState([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [generatingKey, setGeneratingKey] = useState(false);

  const fetchApiKeys = useCallback(async () => {
    setLoadingKeys(true);
    try {
      const keysList = await getConfigGeneral('api_keys');
      setApiKeys(Array.isArray(keysList) ? keysList : []);
    } catch (error) {
      console.warn('Error fetching API keys:', error);
      showAlert('Error al cargar las llaves de API.', 'danger');
    } finally {
      setLoadingKeys(false);
    }
  }, [showAlert]);

  const handleToggleKeyDebug = async (keyId, currentDebug) => {
    try {
      const currentList = (await getConfigGeneral('api_keys')) || [];
      const updated = currentList.map(k => k.id === keyId ? { ...k, debugMode: !currentDebug } : k);
      await setConfigGeneral('api_keys', updated);
      setApiKeys(updated);
      showAlert('Modo depuración de API Key actualizado.', 'success');
    } catch (error) {
      console.warn('Error updating key debug mode:', error);
      showAlert('Error al actualizar modo depuración de API key.', 'danger');
    }
  };

  const handleToggleKeyActive = async (keyId, currentActive) => {
    try {
      const currentList = (await getConfigGeneral('api_keys')) || [];
      const updated = currentList.map(k => k.id === keyId ? { ...k, active: !currentActive } : k);
      await setConfigGeneral('api_keys', updated);
      setApiKeys(updated);
      showAlert(`API Key ${!currentActive ? 'activada' : 'desactivada'} exitosamente.`, 'success');
    } catch (error) {
      console.warn('Error updating key active state:', error);
      showAlert('Error al cambiar estado de API key.', 'danger');
    }
  };

  const handleGenerateApiKey = async (systemId, permissions, debugMode) => {
    if (!systemId.trim()) {
      showAlert('Debes especificar un identificador de sistema.', 'warning');
      return null;
    }

    const perms = [];
    if (permissions.read) perms.push('read');
    if (permissions.write) perms.push('write');

    if (perms.length === 0) {
      showAlert('Debes seleccionar al menos un permiso.', 'warning');
      return null;
    }

    setGeneratingKey(true);
    try {
      const array = new Uint8Array(24);
      window.crypto.getRandomValues(array);
      const generatedKey = 'chz_' + Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');

      // Calcular hash SHA-256 en el cliente usando Web Crypto API
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(generatedKey);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashedKey = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      const keyHint = generatedKey.substring(0, 8) + '...' + generatedKey.slice(-4);

      const currentList = (await getConfigGeneral('api_keys')) || [];
      const newKey = {
        id: 'key_' + Date.now(),
        hash: hashedKey,
        keyHint: keyHint,
        active: true,
        systemId: systemId.trim(),
        permissions: perms,
        debugMode: debugMode,
        createdAt: new Date().toISOString()
      };

      const updated = [newKey, ...currentList];
      await setConfigGeneral('api_keys', updated);
      setApiKeys(updated);

      showAlert('API Key generada con éxito.', 'success');
      return generatedKey;
    } catch (error) {
      console.warn('Error generating API Key:', error);
      showAlert('Error al generar la API Key.', 'danger');
      return null;
    } finally {
      setGeneratingKey(false);
    }
  };

  return {
    apiKeys,
    loadingKeys,
    generatingKey,
    fetchApiKeys,
    handleToggleKeyDebug,
    handleToggleKeyActive,
    handleGenerateApiKey
  };
}
