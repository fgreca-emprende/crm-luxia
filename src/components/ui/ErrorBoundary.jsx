import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ErrorBoundary] Error crítico capturado:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="container py-5 text-center mt-5">
          <div className="card border-0 bg-white shadow-sm rounded-4 p-5 mx-auto" style={{ maxWidth: '600px' }}>
            <div className="rounded-circle bg-danger bg-opacity-10 text-danger d-inline-flex align-items-center justify-content-center p-3 mb-4" style={{ width: '80px', height: '80px' }}>
              <i className="bi bi-exclamation-octagon fs-1"></i>
            </div>
            <h4 className="fw-bold mb-2">Algo salió mal</h4>
            <p className="text-muted mb-4">La sección experimentó un error inesperado al renderizarse. Puedes intentar recargar la página o volver a la vista principal.</p>
            <div className="d-flex gap-3 justify-content-center">
              <button className="btn btn-primary rounded-pill px-4" onClick={() => window.location.reload()}>
                <i className="bi bi-arrow-clockwise me-2"></i>Recargar Aplicación
              </button>
              <button className="btn btn-outline-secondary rounded-pill px-4" onClick={() => this.setState({ hasError: false, error: null })}>
                Reintentar
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
