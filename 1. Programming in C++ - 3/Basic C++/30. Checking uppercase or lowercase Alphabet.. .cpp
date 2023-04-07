#include <iostream>
using namespace std;
int main()
{
   char n;
   cout<<"***   Enter a Alphabet for checking - it is Uppercase or  Lowercase..   ***"<<endl;
   cout<<"Input a Alphabet  = ";
   cin>>n;

   if(n>='a' && n<='z' )
   {
       cout<<"***  "<<n<< "  is Lowercase Alphabet ...***";
   }
   else
   {
            cout<<"***  "<<n<< "  is Uppercase Alphabet ...***";
   }
}

