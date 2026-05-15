import { writable, derived } from 'svelte/store';

function createCart() {
	const { subscribe, update, set } = writable({});

	return {
		subscribe,
		add(product) {
			update((c) => {
				const current = c[product.id]?.quantity ?? 0;
				const maxStock = product.stock !== null && product.stock !== undefined ? product.stock : Infinity;
				if (current >= maxStock) return c;
				return {
					...c,
					[product.id]: { product, quantity: current + 1 }
				};
			});
		},
		remove(productId) {
			update((c) => {
				const { [productId]: _, ...rest } = c;
				return rest;
			});
		},
		updateQty(productId, delta) {
			update((c) => {
				if (!c[productId]) return c;
				const product = c[productId].product;
				const maxStock = product.stock !== null && product.stock !== undefined ? product.stock : Infinity;
				const newQty = c[productId].quantity + delta;
				if (newQty <= 0) {
					const { [productId]: _, ...rest } = c;
					return rest;
				}
				const clampedQty = Math.min(newQty, maxStock);
				return { ...c, [productId]: { ...c[productId], quantity: clampedQty } };
			});
		},
		clear() {
			set({});
		}
	};
}

export const cart = createCart();
export const cartItems = derived(cart, ($cart) => Object.values($cart));
export const cartCount = derived(cartItems, ($items) =>
	$items.reduce((s, c) => s + c.quantity, 0)
);
export const cartTotal = derived(cartItems, ($items) =>
	$items.reduce((s, c) => s + c.product.price * c.quantity, 0)
);
