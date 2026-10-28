import React from 'react';

// DECISION: защита от «дашборд появился и пропал (белый экран)» — любая runtime-ошибка
// рендера (например, WebGL/Three.js на слабых устройствах или битые данные) раньше
// размонтировала всё дерево React. Границца перехватывает ошибку, показывает сообщение
// и позволяет перезагрузить страницу вместо пустого экрана.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('Render error:', error, info?.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="app">
          <div className="empty-state">
            <h3>Что-то пошло не так</h3>
            <p>{String(this.state.error?.message || this.state.error)}</p>
            <button className="btn" onClick={() => window.location.reload()}>Перезагрузить</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
