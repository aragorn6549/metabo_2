
function DishesTab({ dishes, onEditDish, onDeleteDish, onAddDish }) {
  return (
    <div>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-1px', marginBottom: 6 }}>🍽 Рацион</div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>Каталог блюд — используется при логировании еды</div>
        </div>
        <button className="btn" style={{ width: 'auto', padding: '10px 20px' }} onClick={onAddDish}>
          + Блюдо
        </button>
      </div>
      {dishes.length === 0 ? (
        <div className="empty-dishes">
          <h3>Пока пусто</h3>
          <p>Добавь блюдо кнопкой «+ Блюдо» или залогируй еду с новым названием</p>
        </div>
      ) : (
        <div className="dishes-grid">
          {dishes.map(d => (
            <div key={d.id} className="dish-card">
              <div className="dish-header">
                <div className="dish-name">{d.name}</div>
                <div className="entry-actions">
                  <button onClick={() => onEditDish(d)} title="Редактировать">✎</button>
                  <button className="danger" onClick={() => onDeleteDish(d)} title="Удалить">×</button>
                </div>
              </div>
              <div className="dish-macros">
                <div className="dish-macro cal">
                  <span>Калории</span>
                  <strong>{Math.round(d.calories || 0)} ккал</strong>
                </div>
                <div className="dish-macro">
                  <span>Белки</span>
                  <strong>{(+d.protein || 0).toFixed(1)} г</strong>
                </div>
                <div className="dish-macro">
                  <span>Жиры</span>
                  <strong>{(+d.fat || 0).toFixed(1)} г</strong>
                </div>
                <div className="dish-macro">
                  <span>Углеводы</span>
                  <strong>{(+d.carbs || 0).toFixed(1)} г</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default DishesTab;
