import { Ic, I } from "./Icon";

export default function Modal({ title, icon, onClose, children, footer }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-hd">
          <span className="modal-title">
            {icon && <Ic d={icon} s={16} />}
            {title}
          </span>
          <button className="x-btn" onClick={onClose}>
            <Ic d={I.x} s={15} />
          </button>
        </div>
        <div className="modal-bd">
          {children}
        </div>
        {footer && <div className="modal-ft">{footer}</div>}
      </div>
    </div>
  );
}
