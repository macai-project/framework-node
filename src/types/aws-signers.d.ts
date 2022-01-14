declare module "aws-sdk/lib/signers/v4" {
  class SignerV4 {
    constructor(request: AWS.HTTPRequest, scope: string, idk: boolean);
    addAuthorization(credentials: any, date: Date);
  }
  export = SignerV4;
}
