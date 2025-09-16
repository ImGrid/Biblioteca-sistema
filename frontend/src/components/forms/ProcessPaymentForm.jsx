import React, { useState } from 'react';
import { finesService } from '../../services/fines';
import { useNotification } from '../../context/NotificationContext';
import { formatCurrency } from '../../utils/formatters';
import Button from '../common/Button';

const ProcessPaymentForm = ({ fine, onClose, onSuccess }) => {
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { success, error: showError } = useNotification();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const result = await finesService.processPayment(fine.id, { 
        payment_method: paymentMethod, 
        notes 
      });

      if (result.success) {
        success(`Pago de ${formatCurrency(fine.amount)} procesado exitosamente.`);
        onSuccess();
      } else {
        showError(result.message || "No se pudo procesar el pago.");
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
        <h2 className="text-xl font-semibold">Procesar Pago de Multa</h2>
        <p className="text-sm text-gray-500">
          Estás a punto de registrar el pago para el usuario <span className="font-medium">{fine.first_name} {fine.last_name}</span>.
        </p>
      </div>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-sm text-gray-600">Monto a Pagar:</div>
          <div className="text-3xl font-bold text-blue-800">{formatCurrency(fine.amount)}</div>
      </div>

      <div>
        <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-700">Método de Pago</label>
        <select
          id="paymentMethod"
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
        >
          <option value="efectivo">Efectivo</option>
          <option value="tarjeta">Tarjeta de Crédito/Débito</option>
          <option value="transferencia">Transferencia</option>
          <option value="otro">Otro</option>
        </select>
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700">Notas (Opcional)</label>
        <textarea
          id="notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Añadir notas sobre el pago..."
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
        />
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {isSubmitting ? 'Procesando...' : `Confirmar Pago de ${formatCurrency(fine.amount)}`}
        </Button>
      </div>
    </form>
  );
};

export default ProcessPaymentForm;
