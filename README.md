# 🔥 Spark

___Yet another NodeJS framework for backend REST API development focused on productivity and fast prototyping___


## Goals
Create a NodeJS backend template for the FAST DEVELOPMENT of ideas!  
**This package is still ages from production-ready**, and sincerely thats not the main goal at the moment;  
The single maintainer (me) is a physician who enjoys creating tools for its daily needs, even if he enjoy using other frameworks they fail to provide the speed of development I desire; If you're looking for a production ready framework i suggest looking for:
* express
* fastify
* nestjs
* koa

These are all battle tested and widely used by developers and have active maintainers!

______________________________________
## Why 🔥 Spark?  
✅ Highly opinionated, demanding less overhead and decisions not related to the problem at hand (even tough it creates a small learning curve);  
✅ Bits of magic, code wiring is done mostly though conventions cutting most of the boilerplate required to spin up an ideia and keeping configurations to a minimum;  
✅ Written in Typescript, so your IDE can boost you even higher!  
✅ Fast to compile and test, using tsx / vitest;  
✅ Sane amount of dependencies (trying to keep them to a minimum but for some tasks we still need them!);  
✅ Open source (even if it has a single maintainer, if you enjoy the project and wanna contribute feel free to!)
________________________________  

## Installation

For now it's not in the npm repo and if there's any interest you should clone this repository

_________________________

## API routes
_____________________

### Receiving JSON data from request body
To receive the data from the request body we need to define the expected schema using [colinhacks/zod](https://github.com/colinhacks/zod)!  
After we define the schema, the request object (always passed as the first parameter in the handler function) will have its body property correctly typed! More than properly typed the handler shall only be called if an appropriate request body was sent!  
The data shall not only has its type verified, zod can do much more to parse, transform and validate!  
[Check zod documentation](https://zod.dev/) and see what can be done!  
**Example:**
```ts
import { createRoute } from "#http/route";
import { z } from 'zod';

const LoginRequestSchema = z.object({
    username: z.string().min(4),
    password: z.string().min(8).regex(/[A-z][0-9][_-@#]/),
    keepSession : z.boolean().default(false)
});

export default createRoute({
  body : LoginRequestSchema,
  // This handler will only be called if the correct data shape was given!
  handler(req) {
    // We can safely do this because it has already been validated! 
    const { username, password, keepSession} = req.body;
    return username;
  }
});
```

### Receiving files from request body
When working with *"multipart/form-data"* all the file rules should be specified OUTSIDE of the body schema!  
There's a dedicated field in the "createRoute" called fields that accepts the rules for each file field being received from a form!  
The data itself is parsed and validated by ["formidable"](https://github.com/node-formidable/formidable), it's a great library for multipart but is creates temporary files, keep that in mind!  

**Example:**
```ts
// TODO: create file example
```

### Receiving and validating required headers, cookies and query parameters
Another data source soming from either the URL (for query parameters) or the headers, they follow the same principle of the request body except that they are a "record" of validations:
```ts 
Record<string, Zod...>
```
instead of "AnyZodObject", the setup is almost the same, as follows:
```ts
import { createRoute } from "#http/route";
import { z } from 'zod';

const RequiredHeaders ={
  'x-authorization' : z.string().regex(/[0-9]/),
  'x-other-custom-header' : z.string().min(5),
  // ...
};

const QueryParams = {
  'a' : z.number().min(2).optional()
};

const Cookies = {
  'MY_COOKIE' : z.string().min(5)
};

export default createRoute({
  headers : RequiredHeaders,
  queryParams : QueryParams,
  cookies : Cookies,
  handler(req) {
    req.cookie;
    req.headers['x-authorization'];
    req.queryParams.a;
  }
});
```



## Dependency Injection
Spark uses [awilix](https://github.com/jeffijoe/awilix) for its dependency injection / service container;  
Awilix itself has 2 "ways" of working:
- **Classic**, which "parses" the function parameter names and uses them to inject the dependencies;
- **Proxy**, which uses a Proxy object to do pretty much the same as the classic version but whitout needing to "reflect" the paremeter names;
  
🔥 Spark opts for the first mode (Classic)!

The assigned "name" for the service will be used to inject it in the functions which accepts services

**Example:**
```ts
// in '#services/example/example.service'
export class ExampleService {

  sayHello(name? : string) {
    return `hello${name != null ? ` ${name}` : ''}`;
  }
}

// in main.ts
import { type AwilixContainer, asClass } from 'awilix';
import { ExampleService } from '#services/example/example.service';
const container : AwilixContainer = createContainer();
container.register({
  exampleService : asClass(ExampleService)
});

// in a route or controller, eg: index.get.ts
export default createRoute({
  url : ':name',
  handler(request, exampleService : ExampleService) {
    return exampleService.sayHello(request.name);
  }
});
```
In the example above we can see how easy is to bind a service to a route, the container will resolve all of the dependencies from the necessary service and pass it to the handler as an argument.  
⚠️ The "glue" that actually connects the "ExampleService" to the handler its the **PARAMETER NAME** (exampleService), which is the same as the registered in the container, the types from typescript vanishes during compilation and cannot be used for discovery.  
In case we mispell the parameter name the handler will throw an "Internal Server Error" acusing the missing service from its underlying container;

### Auto-importing / registration
Just like the API Routes there's a special folder in app called "services", everything that's a "name.service.ts" file will be looked up and imported into the container.  
Just like suggested in awilix documentation we use camelCase for class names registrations, functions and values;
You can customize the name of a class, function or object by setting a static symbol, exported by Spark, called [DependencyName];  
There's also another option to control the lifetime of classes called [DependencyLifetime];  
**Example:**
```ts
// - file: /services/example/example.service.ts
import { DependencyName } from '#container/symbols';

export class ExampleService {
  static [DependencyName] = 'example';
  // now to access ExampleService we need to use the parameter name: 'example'

  sayHi() {
    return 'hi';
  }
}

// - file: /services/another/another_example.service.ts
import { DependencyLifetime } from '#container/symbols';
import { Lifetime } from 'awilix';

// to access AnotherExampleService we need to use the parameter name: 'anotherExampleService' (it will be a singleton!)

export class AnotherExampleService {
  
  static [DependencyLifetime] = Lifetime.SINGLETON;

  sayHello() {
    return 'hello';
  }
}
```
___________________

## TODOS:
* [ ] Finish this "documentation" including "controllers", request and response "middlewares", route guards, sending custom responses, the request lifecycle, how to use scoped containers for DI...
* [ ] Try to move to "proxy" mode in awilix, it will require some script to update the "awilix context" type (right now we don't use proxy mode because the experience using it with typescript its suboptimal)
* [ ] Use busyboy as multipart parser (? it streams instead of writing to a temp file... would be easier to apply the validations)
* [ ] Generate the dev script for automatic build and project launch/reload
* [ ] Cleanup the routes folder
* [ ] Implement Websockets
* [ ] Create an example ".env" file
* [ ] Check if we can use JSONSchema instead of zod (AJV is faster, JSONSchema has greater interop), zod is WAY more powerful, but maybe we could add a layer abover @sinclair/typebox (for JSONSchema creation/type inference) and create some validations ourself?