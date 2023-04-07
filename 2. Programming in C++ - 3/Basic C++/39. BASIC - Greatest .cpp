#include <iostream>

using namespace std;

int main() {

  int a,b,c, g ,minor;
  cin>>a>>b>>c;
 minor = (a+b+abs(a-b))/2;
 g = (minor + c + abs(minor - c))/2;

 cout<<g<<" eh o maior"<<endl;
    return 0;
}
