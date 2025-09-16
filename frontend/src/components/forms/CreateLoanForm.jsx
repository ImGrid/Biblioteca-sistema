import React, { useState, useEffect, useCallback } from "react";
import { booksService } from "../../services/books";
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

  // User search state (placeholder)
  const [userSearch, setUserSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);

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
        .finally(() => setIsSearchingBook(false));
    }, 500); // 500ms debounce

    return () => {
      clearTimeout(handler);
    };
  }, [bookSearch]);

  const handleSelectBook = (book) => {
    setSelectedBook(book);
    setBookSearch(book.title);
    setBookResults([]);
  };

  const clearSelectedBook = () => {
    setSelectedBook(null);
    setBookSearch("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBook || !selectedUser) {
      showError("Debe seleccionar un usuario y un libro.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await loansService.createLoan({
        user_id: selectedUser.id,
        book_id: selectedBook.id,
      });
      if (result.success) {
        success("Préstamo creado exitosamente.");
        onSuccess();
      } else {
        showError(result.message || "No se pudo crear el préstamo.");
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
        <h2 className="text-xl font-semibold">Crear Nuevo Préstamo</h2>
        <p className="text-sm text-gray-500">
          Busque un usuario y un libro para registrar un nuevo préstamo.
        </p>
      </div>

      {/* User Search - Placeholder */}
      <div className="p-4 border border-dashed rounded-md bg-gray-50">
        <label className="block text-sm font-medium text-gray-700">
          Buscar Usuario
        </label>
        <Input
          type="text"
          placeholder="Funcionalidad pendiente: se requiere API de búsqueda de usuarios"
          disabled={true}
        />
        <p className="text-xs text-gray-400 mt-1">
          Este campo se activará cuando la API del backend esté lista.
        </p>
      </div>

      {/* Book Search */}
      <div className="relative">
        <label className="block text-sm font-medium text-gray-700">
          Buscar Libro
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
            size="sm"
            variant="outline"
            className="absolute right-2 top-7"
            onClick={clearSelectedBook}
          >
            Limpiar
          </Button>
        )}

        {isSearchingBook && (
          <p className="text-sm text-gray-500 mt-1">Buscando...</p>
        )}

        {bookResults.length > 0 && (
          <ul className="absolute z-10 w-full bg-white border rounded-md mt-1 max-h-60 overflow-y-auto">
            {bookResults.map((book) => (
              <li
                key={book.id}
                className="p-2 hover:bg-gray-100 cursor-pointer"
                onClick={() => handleSelectBook(book)}
              >
                {book.title} ({book.publication_year})
                <span className="text-xs text-gray-500 block">
                  {book.authors}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
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
