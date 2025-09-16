import React, { useState, useEffect } from "react";
import { booksService } from "../../services/books";
import { usersService } from "../../services/users";
import { loansService } from "../../services/loans";
import { useNotification } from "../../context/NotificationContext";
import Button from "../common/Button";
import Input from "../common/Input";

const CreateLoanForm = ({ onClose, onSuccess }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { success, error: showError } = useNotification();

  // Book search state
  const [bookSearch, setBookSearch] = useState("");
  const [bookResults, setBookResults] = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);
  const [isSearchingBook, setIsSearchingBook] = useState(false);

  // User search state
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isSearchingUser, setIsSearchingUser] = useState(false);

  // Loan parameters
  const [loanDays, setLoanDays] = useState(14);
  const [notes, setNotes] = useState("");

  // Debounce effect for book search
  useEffect(() => {
    if (bookSearch.length < 3) {
      setBookResults([]);
      return;
    }

    setIsSearchingBook(true);
    const handler = setTimeout(() => {
      booksService
        .searchBooks({ q: bookSearch, limit: 5 })
        .then((response) => {
          if (response.success) {
            setBookResults(response.data || []);
          }
        })
        .catch(() => setBookResults([]))
        .finally(() => setIsSearchingBook(false));
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [bookSearch]);

  // Debounce effect for user search
  useEffect(() => {
    if (userSearch.length < 2) {
      setUserResults([]);
      return;
    }

    setIsSearchingUser(true);
    const handler = setTimeout(() => {
      usersService
        .searchUsers({ q: userSearch, limit: 5 })
        .then((response) => {
          if (response.success) {
            setUserResults(response.data || []);
          }
        })
        .catch(() => setUserResults([]))
        .finally(() => setIsSearchingUser(false));
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [userSearch]);

  const handleSelectBook = (book) => {
    setSelectedBook(book);
    setBookSearch(book.title);
    setBookResults([]);
  };

  const clearSelectedBook = () => {
    setSelectedBook(null);
    setBookSearch("");
  };

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setUserSearch(`${user.first_name} ${user.last_name} (${user.email})`);
    setUserResults([]);
  };

  const clearSelectedUser = () => {
    setSelectedUser(null);
    setUserSearch("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBook || !selectedUser) {
      showError("Debe seleccionar un usuario y un libro.");
      return;
    }

    if (loanDays < 1 || loanDays > 30) {
      showError("Los días de préstamo deben estar entre 1 y 30.");
      return;
    }

    setIsSubmitting(true);
    try {
      const loanData = {
        user_id: selectedUser.id,
        book_id: selectedBook.id,
        loan_days: parseInt(loanDays),
        notes: notes.trim() || undefined,
      };

      const result = await loansService.createLoan(loanData);

      if (result.success) {
        success("Préstamo creado exitosamente.");
        onSuccess();
      } else {
        // El backend devuelve errores de validación detallados
        if (
          result.error &&
          typeof result.error === "object" &&
          result.error.loan
        ) {
          showError(result.error.loan.join(", "));
        } else {
          showError(result.message || "No se pudo crear el préstamo.");
        }
      }
    } catch (err) {
      const errorMessage =
        err.response?.data?.error?.message ||
        err.message ||
        "Error de conexión";
      showError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Crear Nuevo Préstamo</h2>
        <p className="text-sm text-gray-500">
          Busque un usuario y un libro para registrar un nuevo préstamo.
        </p>
      </div>

      {/* User Search */}
      <div className="relative">
        <label className="block text-sm font-medium text-gray-700">
          Buscar Usuario <span className="text-red-500">*</span>
        </label>
        <Input
          type="text"
          placeholder="Buscar por nombre o email..."
          value={userSearch}
          onChange={(e) => setUserSearch(e.target.value)}
          disabled={!!selectedUser}
        />
        {selectedUser && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="absolute right-2 top-7"
            onClick={clearSelectedUser}
          >
            Limpiar
          </Button>
        )}

        {isSearchingUser && (
          <p className="mt-1 text-sm text-gray-500">Buscando usuarios...</p>
        )}

        {userResults.length > 0 && (
          <ul className="absolute z-10 w-full mt-1 overflow-y-auto bg-white border rounded-md max-h-60">
            {userResults.map((user) => (
              <li
                key={user.id}
                className="p-3 border-b cursor-pointer hover:bg-gray-100 last:border-b-0"
                onClick={() => handleSelectUser(user)}
              >
                <div className="font-medium text-gray-900">
                  {user.first_name} {user.last_name}
                </div>
                <div className="text-sm text-gray-600">{user.email}</div>
                {user.phone && (
                  <div className="text-xs text-gray-500">{user.phone}</div>
                )}
              </li>
            ))}
          </ul>
        )}

        {selectedUser && (
          <div className="p-2 mt-2 border border-green-200 rounded-md bg-green-50">
            <div className="text-sm">
              <strong>Usuario seleccionado:</strong> {selectedUser.first_name}{" "}
              {selectedUser.last_name}
            </div>
            <div className="text-xs text-gray-600">{selectedUser.email}</div>
          </div>
        )}
      </div>

      {/* Book Search */}
      <div className="relative">
        <label className="block text-sm font-medium text-gray-700">
          Buscar Libro <span className="text-red-500">*</span>
        </label>
        <Input
          type="text"
          placeholder="Buscar por título o ISBN..."
          value={bookSearch}
          onChange={(e) => setBookSearch(e.target.value)}
          disabled={!!selectedBook}
        />
        {selectedBook && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="absolute right-2 top-7"
            onClick={clearSelectedBook}
          >
            Limpiar
          </Button>
        )}

        {isSearchingBook && (
          <p className="mt-1 text-sm text-gray-500">Buscando libros...</p>
        )}

        {bookResults.length > 0 && (
          <ul className="absolute z-10 w-full mt-1 overflow-y-auto bg-white border rounded-md max-h-60">
            {bookResults.map((book) => (
              <li
                key={book.id}
                className="p-3 border-b cursor-pointer hover:bg-gray-100 last:border-b-0"
                onClick={() => handleSelectBook(book)}
              >
                <div className="font-medium text-gray-900">{book.title}</div>
                <div className="text-sm text-gray-600">
                  {book.authors} ({book.publication_year})
                </div>
                <div className="text-xs text-gray-500">
                  Disponibles: {book.available_copies}
                  {book.isbn && ` • ISBN: ${book.isbn}`}
                </div>
              </li>
            ))}
          </ul>
        )}

        {selectedBook && (
          <div className="p-2 mt-2 border border-blue-200 rounded-md bg-blue-50">
            <div className="text-sm">
              <strong>Libro seleccionado:</strong> {selectedBook.title}
            </div>
            <div className="text-xs text-gray-600">
              {selectedBook.authors} • Disponibles:{" "}
              {selectedBook.available_copies}
            </div>
          </div>
        )}
      </div>

      {/* Loan Parameters */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input
          label="Días de Préstamo"
          type="number"
          value={loanDays}
          onChange={(e) => setLoanDays(e.target.value)}
          min="1"
          max="30"
          required
        />
        <div className="flex items-end">
          <div className="text-sm text-gray-500">
            Vencimiento:{" "}
            {new Date(
              Date.now() + loanDays * 24 * 60 * 60 * 1000
            ).toLocaleDateString("es-ES")}
          </div>
        </div>
      </div>

      <div>
        <label className="block mb-1 text-sm font-medium text-gray-700">
          Notas (Opcional)
        </label>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notas adicionales sobre el préstamo..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex justify-end pt-4 space-x-2">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isSubmitting}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          loading={isSubmitting}
          disabled={!selectedBook || !selectedUser}
        >
          Crear Préstamo
        </Button>
      </div>
    </form>
  );
};

export default CreateLoanForm;
