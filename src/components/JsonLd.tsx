// src/components/JsonLd.tsx
import React from 'react';

// JSON-LD value can be any of these types or arrays of these types
type JsonLdPrimitive = string | number | boolean | null;
type JsonLdArray = Array<JsonLdValue>;
// Using a recursive type definition for nested objects
type JsonLdObject = { [key: string]: JsonLdValue };
type JsonLdValue = JsonLdPrimitive | JsonLdObject | JsonLdArray;

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