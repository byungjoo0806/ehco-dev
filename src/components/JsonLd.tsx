// src/components/JsonLd.tsx
import React from 'react';

// JSON-LD value can be any of these types or arrays of these types
export type JsonLdPrimitive = string | number | boolean | null;
export type JsonLdArray = Array<JsonLdValue>;
// Using a recursive type definition for nested objects
export type JsonLdObject = { [key: string]: JsonLdValue };
export type JsonLdValue = JsonLdPrimitive | JsonLdObject | JsonLdArray;

interface JsonLdProps {
    data: JsonLdObject;
}

export default function JsonLd({ data }: JsonLdProps) {
    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
        />
    );
}