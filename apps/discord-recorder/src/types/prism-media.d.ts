declare module "prism-media" {
  import type { Transform } from "node:stream";

  interface OpusDecoderOptions {
    rate: number;
    channels: number;
    frameSize: number;
  }

  const prism: {
    opus: {
      Decoder: new (options: OpusDecoderOptions) => Transform;
    };
  };

  export default prism;
}
