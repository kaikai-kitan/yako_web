import { writable, derived } from 'svelte/store';

function createCart() {
	const { subscribe, update, set } = writable({});

	return {
		subscribe,
		add(product) {
			update((c) => ({
				...c,
				[product.id]: c[product.id]
					? { product, quantity: c[product.id].quantity + 1 }
					: { product, quantity: 1 }
			}));
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
				const newQty = c[productId].quantity + delta;
				if (newQty <= 0) {
					const { [productId]: _, ...rest } = c;
					return rest;
				}
				return { ...c, [productId]: { ...c[productId], quantity: newQty } };
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
