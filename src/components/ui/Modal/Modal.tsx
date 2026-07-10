import type { FC, ReactNode } from "react";
import { Modal as BsModal } from "react-bootstrap";
import ModalCloseButton from "../../Extras/ModalCloseButton";
import styles from "./Modal.module.scss";

interface ModalProps {
  show: boolean;
  onHide: () => void;
  title: ReactNode;
  children: ReactNode;
  headerStart?: ReactNode;
  footer?: ReactNode;
  className?: string;
  dialogClassName?: string;
  centered?: boolean;
  size?: "sm" | "lg" | "xl";
}

const Modal: FC<ModalProps> = ({
  show,
  onHide,
  title,
  children,
  headerStart,
  footer,
  className,
  dialogClassName,
  centered = true,
  size,
}) => (
  <BsModal
    show={show}
    onHide={onHide}
    centered={centered}
    size={size}
    dialogClassName={dialogClassName}
    className={[styles.themedModal, className].filter(Boolean).join(" ")}
  >
    <BsModal.Header>
      {headerStart}
      <BsModal.Title>{title}</BsModal.Title>
      <ModalCloseButton onClick={onHide} />
    </BsModal.Header>
    <BsModal.Body>{children}</BsModal.Body>
    {footer && <BsModal.Footer>{footer}</BsModal.Footer>}
  </BsModal>
);

export default Modal;
