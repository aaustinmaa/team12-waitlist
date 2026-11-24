// Entry: the referrer page (refer/index.html), where family doctors compare clinic waits before referring.
import { mount } from "./boot";
import { ReferrerApp } from "./apps/referrer/ReferrerApp";

mount(<ReferrerApp />, "refer");
