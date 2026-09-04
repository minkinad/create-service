export interface Greeting {
  message: string;
}

export class GreetingService {
  public greet(name: string): Greeting {
    return { message: `Hello, ${name}!` };
  }
}
