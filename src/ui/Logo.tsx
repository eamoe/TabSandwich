import styles from "./Logo.module.css";

/**
 * The app's mark for purple backgrounds: the icon (branding/icon.svg) without its tile. Same shapes
 * as branding/mark.svg, drawn on the 32 px icon's grid so it stays crisp at header size; colors come
 * from the tokens. Decorative: the popup's name is announced elsewhere.
 */
export function Logo() {
    return (
        <svg class={styles.logo} width="18" height="15" viewBox="7 8 18 15" aria-hidden="true" focusable="false">
            <path class={styles.bread} d="M8 14 L9.6 9.3 Q10 8 11.4 8 H20.6 Q22 8 22.4 9.3 L24 14 Z" />
            <rect class={styles.filling} x="7" y="15" width="18" height="3" rx="1.5" />
            <rect class={styles.bread} x="8" y="19" width="16" height="4" rx="2" />
        </svg>
    );
}
