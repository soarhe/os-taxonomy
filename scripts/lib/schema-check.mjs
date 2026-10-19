// Dependency-free evaluator for the vocabulary used by this repository's four
// data schemas. Fail closed if a future schema introduces an unsupported keyword.
const supported = new Set(['$schema','$id','title','description','type','required','properties','items','enum','pattern','minimum','maximum','additionalProperties','minItems','minLength']);
function matches(v,t) {
  if(t==='null') return v===null;
  if(t==='array') return Array.isArray(v);
  if(t==='object') return v!==null && typeof v==='object' && !Array.isArray(v);
  if(t==='integer') return Number.isInteger(v);
  if(t==='number') return typeof v==='number' && Number.isFinite(v);
  return typeof v===t;
}
export function checkSchema(value,schema,path='$',errors=[]) {
  for(const key of Object.keys(schema)) if(!supported.has(key)) throw new Error(`Unsupported schema keyword: ${key}`);
  if(schema.type && ![schema.type].flat().some(t=>matches(value,t))) { errors.push(`${path}: invalid type`); return errors; }
  if(schema.enum && !schema.enum.includes(value)) errors.push(`${path}: invalid enum`);
  if(typeof value==='string') {
    if(schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${path}: invalid pattern`);
    if(schema.minLength!==undefined && value.length<schema.minLength) errors.push(`${path}: too short`);
  }
  if(typeof value==='number') {
    if(schema.minimum!==undefined && value<schema.minimum) errors.push(`${path}: below minimum`);
    if(schema.maximum!==undefined && value>schema.maximum) errors.push(`${path}: above maximum`);
  }
  if(Array.isArray(value)) {
    if(schema.minItems!==undefined && value.length<schema.minItems) errors.push(`${path}: too few items`);
    if(schema.items) value.forEach((v,i)=>checkSchema(v,schema.items,`${path}[${i}]`,errors));
  } else if(value!==null && typeof value==='object') {
    for(const key of schema.required??[]) if(!Object.hasOwn(value,key)) errors.push(`${path}: missing ${key}`);
    for(const [key,v] of Object.entries(value)) {
      if(schema.properties?.[key]) checkSchema(v,schema.properties[key],`${path}.${key}`,errors);
      else if(schema.additionalProperties===false) errors.push(`${path}: extra field ${key}`);
    }
  }
  return errors;
}
