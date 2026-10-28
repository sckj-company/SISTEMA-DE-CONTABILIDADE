import React from 'react';
import { useTranslation } from 'react-i18next';

const ConfirmModal = ({
  show,
  onClose,
  onConfirm,
  title,
  subtitle,
  confirmLabel,
  confirmClass = 'btn-primary',
  children,
}) => {
  const { t } = useTranslation();
  if (!show) return null;

  return (
    <>
      <div
        className="modal fade show"
        tabIndex="-1"
        role="dialog"
        aria-modal="true"
        style={{ display: 'block' }}
        onClick={onClose}
      >
        <div className="modal-dialog modal-md" role="document" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content">
            <div
              className="modal-header"
              style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0' }}
            >
              <div>
                <h6 className="modal-title" style={{ color: '#0f172a', fontWeight: 700, fontSize: 17 }}>
                  {title}
                </h6>
                {subtitle && (
                  <span className="d-block" style={{ fontSize: 12.5, color: '#64748b' }}>
                    {subtitle}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="close"
                aria-label={t('common.close')}
                onClick={onClose}
                style={{ color: '#475569' }}
              >
                <span aria-hidden="true">&times;</span>
              </button>
            </div>

            <div className="modal-body p-25" style={{ backgroundColor: '#ffffff' }}>{children}</div>

            <div
              className="modal-footer d-flex justify-content-end"
              style={{ backgroundColor: '#ffffff', borderTop: '1px solid #e2e8f0', padding: '15px 25px', gap: 10 }}
            >
              <button type="button" className="btn btn-outline-primary btn-squared" onClick={onClose}>
                {t('common.cancel')}
              </button>
              <button type="button" className={`btn btn-squared ${confirmClass}`} onClick={onConfirm}>
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );
};

export default ConfirmModal;
