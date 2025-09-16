import React, { useState } from 'react';
import { loansService } from '../../services/loans';
import { useNotification } from '../../context/NotificationContext';
import Button from '../common/Button';
import Input from '../common/Input';

const ExtendLoanForm = ({ loan, onClose, onSuccess }) => {
  const [extensionDays, setExtensionDays] = useState(7);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { success, error: showError } = useNotification();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason) {
        showError("Se requiere un motivo para la extensión.");
        return;
    }

    setIsSubmitting(true);
    try {
      const result = await loansService.extendLoan(loan.id, { 
        extension_days: parseInt(extensionDays, 10),
        reason 
      });

      if (result.success) {
        success(`El préstamo ha sido extendido por ${extensionDays} días.`);
        onSuccess();
      } else {
        showError(result.message || "No se pudo extender el préstamo.");
      }
    } catch (err) {
      showError(err.message || "Ocurrió un error de red.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Extender Préstamo</h2>
        <p className="text-sm text-gray-500">
          Libro: <span className="font-medium">{loan.title}</span>
        </p>
         <p className="text-sm text-gray-500">
          Usuario: <span className="font-medium">{loan.first_name} {loan.last_name}</span>
        </p>
      </div>

      <div>
        <label htmlFor="extensionDays" className="block text-sm font-medium text-gray-700">Días de Extensión</label>
        <Input
          id="extensionDays"
          type="number"
          value={extensionDays}
          onChange={(e) => setExtensionDays(e.target.value)}
          min="1"
          max="30"
          required
        />
      </div>

      <div>
        <label htmlFor="reason" className="block text-sm font-medium text-gray-700">Motivo de la Extensión</label>
        <textarea
          id="reason"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ej: El usuario solicitó más tiempo para terminar el libro."
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          required
        />
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {isSubmitting ? 'Procesando...' : 'Confirmar Extensión'}
        </Button>
      </div>
    </form>
  );
};

export default ExtendLoanForm;
