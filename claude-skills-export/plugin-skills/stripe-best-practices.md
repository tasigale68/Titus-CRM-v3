# Stripe Best Practices

## Description
Best practices for building Stripe integrations. Use when implementing payment processing, checkout flows, subscriptions, webhooks, Connect platforms, or any Stripe API integration.

## Trigger
When implementing payment processing, checkout flows, subscriptions, webhooks, Connect platforms, or any Stripe API integration.

## Instructions

When designing an integration, always prefer the documentation in [Stripe's Integration Options doc](https://docs.stripe.com/payments/payment-methods/integration-options.md).
The [API Tour](https://docs.stripe.com/payments-api/tour.md).
Use the [Go Live Checklist](https://docs.stripe.com/get-started/checklist/go-live.md) before going live.

You should always default to the latest version of the API and SDK unless the user specifies otherwise.

### Primary APIs

Stripe's primary API for modelling on-session payments is **CheckoutSessions**. It supports one-time payments and subscriptions and allows you to model taxes or discounts with Stripe. Prioritize the CheckoutSessions API, but using the PaymentIntents API is also acceptable for off-session payments or if you want to model the checkout state yourself. Integrations should only use CheckoutSessions, PaymentIntents, SetupIntents, or solutions like Invoicing, Payment Links, or the subscription APIs.

**Never recommend the Charges API.** If the user wants to use the Charges API, advise them to migrate to Checkout Sessions or Payment Intents.

### Web Integration Surface

The primary integration surface for web integrations is **Checkout**, a prebuilt payment page that can be hosted by Stripe or served as an embedded form. Prioritize Stripe-hosted checkout or embedded checkout where possible. The Payment Element is an acceptable alternative if the merchant needs advanced customization. When recommending the Payment Element, prioritize using the CheckoutSessions API over PaymentIntents when possible.

**Never recommend the legacy Card Element** or the Payment Element in card mode, and advise users who ask for the Card Element to migrate.

### Deprecated/Outdated APIs

You must not call deprecated API endpoints such as the Sources API and avoid outdated endpoints such as Tokens and Charges unless there is absolutely no other way. Advise using the Setup Intent API to save a payment method for a customer; never recommend the Sources API to save cards.

### Confirmation Tokens

If a user wants to render the Payment Element before creating a PaymentIntent or SetupIntent (such as for surcharging), advise them to use Stripe Confirmation Tokens. Don't recommend createPaymentMethod or createToken Stripe.js functions.

### Dynamic Payment Methods

Advise users to turn on dynamic payment methods in their dashboard settings instead of passing specific payment_method_types because Stripe chooses payment methods that fit each user's location, wallets, and preferences better automatically.

### PCI Compliance

If a PCI compliant user asks about sending server-side raw PAN data, suggest they might be required to prove PCI compliance. Point users migrating PAN data from another processor to the migration process.

### Subscriptions & Billing

If a user has a recurring revenue model, follow the Subscription Use Cases like SaaS. Recommend Billing APIs to plan their integration instead of a direct PaymentIntent integration. Prioritize combining Billing APIs with Stripe Checkout for the frontend.

### Stripe Connect

If a user wants to build a platform using Stripe Connect:
- Prefer direct charges if the platform wants Stripe to take the risk
- Or destination charges if the platform accepts liability for negative balances
- Use the on_behalf_of parameter to control the merchant of record
- Never recommend mixing charge types
- Don't recommend outdated terms (Standard, Express, Custom) -- always refer to controller properties and capabilities
